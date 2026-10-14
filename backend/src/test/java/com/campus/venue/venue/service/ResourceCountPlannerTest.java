package com.campus.venue.venue.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.ResourceType;
import com.campus.venue.venue.service.ResourceCountPlanner.CountChange;
import java.math.BigInteger;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

/** ACC-M3-08：设定场地数量的纯计算（BE-2b 裁决 A3），与 mock planCount、byNameNumber、nextNumber 对照。 */
class ResourceCountPlannerTest {

    private static Resource resource(long id, String name, int sortOrder, ResourceStatus status) {
        Resource resource = new Resource();
        ReflectionTestUtils.setField(resource, "id", id);
        resource.setName(name);
        resource.setSortOrder(sortOrder);
        resource.setOperationalStatus(status);
        resource.setResourceType(ResourceType.COURT);
        return resource;
    }

    private static List<Long> ids(List<Resource> list) {
        return list.stream().map(Resource::getId).toList();
    }

    @Test
    void numberIsTrailingAsciiDigits() {
        assertThat(ResourceCountPlanner.nameNumber(resource(1, "网球场12", 0, ResourceStatus.OPEN)))
                .isEqualTo(BigInteger.valueOf(12));
        assertThat(ResourceCountPlanner.nameNumber(resource(1, "1号场", 0, ResourceStatus.OPEN))).isNull();
        assertThat(ResourceCountPlanner.nameNumber(resource(1, "场" + "9".repeat(30), 0, ResourceStatus.OPEN)))
                .isEqualTo(new BigInteger("9".repeat(30)));
    }

    @Test
    void shrinkOrderIsReverseOfNumberThenIdWithIrregularFirst() {
        List<Resource> existing = List.of(resource(5, "场2", 1, ResourceStatus.OPEN),
                resource(3, "甲场", 2, ResourceStatus.OPEN), resource(4, "场2", 3, ResourceStatus.OPEN),
                resource(7, "乙场", 4, ResourceStatus.OPEN), resource(9, "场10", 5, ResourceStatus.OPEN));

        CountChange change = ResourceCountPlanner.plan(existing, 1, null, null);

        assertThat(ids(change.toDisable())).containsExactly(7L, 3L, 9L, 5L);
        assertThat(change.toEnable()).isEmpty();
        assertThat(change.toCreate()).isEmpty();
    }

    @Test
    void growReenablesInNumberOrderThenCreates() {
        List<Resource> existing = List.of(resource(1, "场1", 1, ResourceStatus.OPEN),
                resource(2, "场3", 2, ResourceStatus.DISABLED), resource(3, "场2", 3, ResourceStatus.DISABLED),
                resource(4, "场4", 4, ResourceStatus.MAINTENANCE));

        CountChange change = ResourceCountPlanner.plan(existing, 5, null, null);

        assertThat(ids(change.toEnable())).containsExactly(3L, 2L);
        assertThat(change.toCreate()).extracting(ResourceCountPlanner.NewResource::name).containsExactly("场5");
        assertThat(change.toCreate().get(0).sortOrder()).isEqualTo(5);
    }

    @Test
    void nextNumberOnlyCountsPrefixPlusDigits() {
        List<Resource> existing = List.of(resource(1, "场7", 1, ResourceStatus.OPEN),
                resource(2, "场A9", 2, ResourceStatus.OPEN), resource(3, "大场20", 3, ResourceStatus.OPEN));

        assertThat(ResourceCountPlanner.nextNumber(existing, "场")).isEqualTo(BigInteger.valueOf(8));
        assertThat(ResourceCountPlanner.nextNumber(existing, "新场")).isEqualTo(BigInteger.ONE);
    }

    @Test
    void emptyVenueNeedsBothDefaults() {
        assertThatThrownBy(() -> ResourceCountPlanner.plan(List.of(), 1, "场", null))
                .isInstanceOfSatisfying(BusinessException.class,
                        ex -> assertThat(ex.getErrorCode()).isEqualTo(ErrorCode.VALIDATION_ERROR));
        assertThat(ResourceCountPlanner.plan(List.of(), 0, null, null).toCreate()).isEmpty();
    }
}
