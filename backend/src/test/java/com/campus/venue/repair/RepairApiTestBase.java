package com.campus.venue.repair;

import static org.assertj.core.api.Assertions.assertThat;

import com.campus.venue.support.ImpactApiTestBase;
import com.fasterxml.jackson.databind.JsonNode;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.test.web.servlet.MvcResult;

/**
 * BE-6 报修接口测试的公共工具。数据沿用 ImpactApiTestBase：时钟 2026-10-12 08:30:15；admin_tennis 只授权网球馆。
 * 列表与处理用例的报修直接写库。
 */
public abstract class RepairApiTestBase extends ImpactApiTestBase {

    protected static final String REPAIRS = "/api/v1/repairs";
    protected static final String MINE = "/api/v1/repairs/me";
    protected static final String ADMIN = "/api/v1/admin/repairs";
    protected static final String UPDATE = "/api/v1/admin/repairs/{id}";

    protected long repair(long reporterId, long venueId, Long resourceId, String status, String resultNote,
            LocalDateTime createdAt) {
        return jdbc.queryForObject("insert into repair_report (venue_id, resource_id, reporter_id, description, status,"
                + " result_note, created_at, updated_at) values (?, ?, ?, '球网破损', ?, ?, ?, ?) returning id",
                Long.class, venueId, resourceId, reporterId, status, resultNote, Timestamp.valueOf(createdAt),
                Timestamp.valueOf(createdAt));
    }

    protected long submitted(long reporterId, long venueId, LocalDateTime createdAt) {
        return repair(reporterId, venueId, null, "SUBMITTED", null, createdAt);
    }

    protected Map<String, Object> repairRow(long id) {
        return jdbc.queryForMap("select * from repair_report where id = ?", id);
    }

    protected int repairCount() {
        return jdbc.queryForObject("select count(*) from repair_report", Integer.class);
    }

    protected List<Long> arrayIds(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        List<Long> list = new ArrayList<>();
        json(result).forEach(item -> list.add(item.get("id").asLong()));
        return list;
    }

    protected List<Long> pageIds(MvcResult result) throws Exception {
        assertThat(result.getResponse().getStatus()).as(result.getResponse().getContentAsString()).isEqualTo(200);
        List<Long> list = new ArrayList<>();
        json(result).get("items").forEach(item -> list.add(item.get("id").asLong()));
        return list;
    }

    protected JsonNode fields(JsonNode error) {
        return error.get("details").get("fields");
    }
}
