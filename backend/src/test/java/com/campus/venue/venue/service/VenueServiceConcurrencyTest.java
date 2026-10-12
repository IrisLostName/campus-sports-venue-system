package com.campus.venue.venue.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.support.AbstractApiTest;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.Venue;
import com.campus.venue.venue.domain.VenueType;
import com.campus.venue.venue.dto.CreateVenueRequest;
import com.campus.venue.venue.repository.ResourceRepository;
import com.campus.venue.venue.repository.VenueRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;

/** A4：并发新建同名场馆只成功一个，其余 VALIDATION_ERROR fields.name；唯一冲突的识别只认 23505 + uq_venue_name。 */
class VenueServiceConcurrencyTest extends AbstractApiTest {

    private static final int THREADS = 5;

    @Autowired
    private VenueService venueService;

    @Autowired
    private VenueRepository venues;

    @Autowired
    private ResourceRepository resources;

    @Test
    void concurrentCreationsOfOneNameYieldExactlyOneVenue() throws Exception {
        CountDownLatch ready = new CountDownLatch(THREADS);
        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(THREADS);
        List<Future<Map<String, Object>>> outcomes = new ArrayList<>();
        try {
            for (int i = 0; i < THREADS; i++) {
                outcomes.add(pool.submit(() -> {
                    ready.countDown();
                    start.await();
                    try {
                        venueService.create(new CreateVenueRequest("篮球馆", "BASKETBALL", null, null));
                        return null;
                    } catch (BusinessException ex) {
                        return Map.of("code", ex.getErrorCode().name(), "details", ex.getDetails());
                    }
                }));
            }
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue();
            start.countDown();
            List<Map<String, Object>> results = new ArrayList<>();
            for (Future<Map<String, Object>> outcome : outcomes) {
                results.add(outcome.get(30, TimeUnit.SECONDS));
            }
            assertThat(results).filteredOn(result -> result == null).hasSize(1);
            assertThat(results).filteredOn(result -> result != null).hasSize(THREADS - 1)
                    .containsOnly(Map.of("code", "VALIDATION_ERROR",
                            "details", Map.of("fields", Map.of("name", "场馆名已存在"))));
        } finally {
            pool.shutdownNow();
        }
        assertThat(jdbc.queryForObject("select count(*) from venue where name = '篮球馆'", Integer.class))
                .isEqualTo(1);
    }

    @Test
    void onlyTheVenueNameUniqueViolationIsTranslated() {
        Venue first = newVenue("网球馆");
        venues.saveAndFlush(first);
        assertThatThrownBy(() -> venues.saveAndFlush(newVenue("网球馆")))
                .isInstanceOfSatisfying(DataIntegrityViolationException.class,
                        ex -> assertThat(VenueService.isNameConflict(ex)).isTrue());

        LocalDateTime now = LocalDateTime.now(clock);
        Resource resource = new Resource();
        resource.setVenueId(first.getId());
        resource.setName("网球场1");
        resource.setCreatedAt(now);
        resource.setUpdatedAt(now);
        resources.saveAndFlush(resource);
        Resource duplicate = new Resource();
        duplicate.setVenueId(first.getId());
        duplicate.setName("网球场1");
        duplicate.setCreatedAt(now);
        duplicate.setUpdatedAt(now);
        assertThatThrownBy(() -> resources.saveAndFlush(duplicate))
                .isInstanceOfSatisfying(DataIntegrityViolationException.class,
                        ex -> assertThat(VenueService.isNameConflict(ex)).isFalse());
        assertThat(VenueService.isNameConflict(new DataIntegrityViolationException("无原因"))).isFalse();
    }

    private Venue newVenue(String name) {
        LocalDateTime now = LocalDateTime.now(clock);
        Venue venue = new Venue();
        venue.setName(name);
        venue.setVenueType(VenueType.TENNIS);
        venue.setCreatedAt(now);
        venue.setUpdatedAt(now);
        return venue;
    }
}
