-- 预约的同行人名单（docs/13 第 3.6a 节 reservation_companion，契约 v1.2，P2-2b）。
-- 只存“哪位用户随该预约同行”及提交顺序；预约仍只属于预约人（docs/03 第 2 节）。
-- 外键与其他表一致，不级联；position 只用于排序，不对外暴露（人员改派移除同行人后保留空档）。
CREATE TABLE reservation_companion (
    reservation_id BIGINT   NOT NULL,
    user_id        BIGINT   NOT NULL,
    position       SMALLINT NOT NULL,
    CONSTRAINT pk_reservation_companion PRIMARY KEY (reservation_id, user_id),
    CONSTRAINT fk_reservation_companion_reservation FOREIGN KEY (reservation_id) REFERENCES reservation (id),
    CONSTRAINT fk_reservation_companion_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT uq_reservation_companion_position UNIQUE (reservation_id, position),
    CONSTRAINT ck_reservation_companion_position CHECK (position BETWEEN 1 AND 6)
);
