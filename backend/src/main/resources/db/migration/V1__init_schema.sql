-- 表结构与约束：逐表逐列对应 docs/13 第 3 节。已应用的迁移脚本不得修改，只能追加新版本。
-- 约定（docs/13 第 1 节）：主键 BIGINT GENERATED ALWAYS AS IDENTITY；枚举用 VARCHAR + CHECK；
-- 时间戳用不带时区的 TIMESTAMP（含义是 APP_TIMEZONE 下的本地时间）；外键全部显式声明，不级联。

-- 3.1 app_user
CREATE TABLE app_user (
    id            BIGINT GENERATED ALWAYS AS IDENTITY,
    username      VARCHAR(32)  NOT NULL,
    password_hash VARCHAR(100) NOT NULL,
    display_name  VARCHAR(50)  NOT NULL,
    role          VARCHAR(20)  NOT NULL,
    user_type     VARCHAR(20)  NOT NULL DEFAULT 'STUDENT',
    phone         VARCHAR(20),
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT pk_app_user PRIMARY KEY (id),
    CONSTRAINT uq_app_user_username UNIQUE (username),
    CONSTRAINT ck_app_user_role CHECK (role IN ('USER', 'VENUE_ADMIN', 'SYS_ADMIN')),
    CONSTRAINT ck_app_user_user_type CHECK (user_type IN ('STUDENT', 'TEACHER', 'OTHER')),
    CONSTRAINT ck_app_user_status CHECK (status IN ('ACTIVE', 'DISABLED'))
);

-- 3.2 venue
CREATE TABLE venue (
    id                   BIGINT GENERATED ALWAYS AS IDENTITY,
    name                 VARCHAR(50)  NOT NULL,
    venue_type           VARCHAR(20)  NOT NULL,
    location             VARCHAR(100),
    description          VARCHAR(500),
    operational_status   VARCHAR(10)  NOT NULL DEFAULT 'OPEN',
    user_booking_enabled BOOLEAN      NOT NULL DEFAULT false,
    created_at           TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at           TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT pk_venue PRIMARY KEY (id),
    CONSTRAINT uq_venue_name UNIQUE (name),
    CONSTRAINT ck_venue_venue_type CHECK (venue_type IN ('TENNIS', 'BADMINTON', 'SWIMMING', 'BASKETBALL', 'OTHER')),
    CONSTRAINT ck_venue_operational_status CHECK (operational_status IN ('OPEN', 'CLOSED'))
);

-- 3.3 resource（场地：球场 / 泳道）
CREATE TABLE resource (
    id                 BIGINT GENERATED ALWAYS AS IDENTITY,
    venue_id           BIGINT      NOT NULL,
    name               VARCHAR(50) NOT NULL,
    resource_type      VARCHAR(20) NOT NULL DEFAULT 'COURT',
    sort_order         INT         NOT NULL DEFAULT 0,
    operational_status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    created_at         TIMESTAMP   NOT NULL DEFAULT now(),
    updated_at         TIMESTAMP   NOT NULL DEFAULT now(),
    CONSTRAINT pk_resource PRIMARY KEY (id),
    CONSTRAINT fk_resource_venue FOREIGN KEY (venue_id) REFERENCES venue (id),
    CONSTRAINT uq_resource_venue_name UNIQUE (venue_id, name),
    CONSTRAINT ck_resource_resource_type CHECK (resource_type IN ('COURT', 'LANE', 'OTHER')),
    CONSTRAINT ck_resource_operational_status CHECK (operational_status IN ('OPEN', 'MAINTENANCE', 'DISABLED'))
);
CREATE INDEX idx_resource_venue_sort ON resource (venue_id, sort_order);

-- 3.4 availability_rule（WEEKLY / CLOSURE 两类规则共用一张表）
-- “窗口长度是 90 分钟整数倍”“同日窗口不重叠”由 Service 层校验，不在表约束里。
CREATE TABLE availability_rule (
    id          BIGINT GENERATED ALWAYS AS IDENTITY,
    venue_id    BIGINT      NOT NULL,
    rule_type   VARCHAR(10) NOT NULL,
    weekday     SMALLINT,
    open_time   TIME,
    close_time  TIME,
    start_date  DATE,
    end_date    DATE,
    resource_id BIGINT,
    reason      VARCHAR(200),
    status      VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    created_by  BIGINT,
    created_at  TIMESTAMP   NOT NULL DEFAULT now(),
    CONSTRAINT pk_availability_rule PRIMARY KEY (id),
    CONSTRAINT fk_availability_rule_venue FOREIGN KEY (venue_id) REFERENCES venue (id),
    CONSTRAINT fk_availability_rule_resource FOREIGN KEY (resource_id) REFERENCES resource (id),
    CONSTRAINT fk_availability_rule_created_by FOREIGN KEY (created_by) REFERENCES app_user (id),
    CONSTRAINT ck_availability_rule_type CHECK (rule_type IN ('WEEKLY', 'CLOSURE')),
    CONSTRAINT ck_availability_rule_status CHECK (status IN ('ACTIVE', 'INACTIVE')),
    CONSTRAINT ck_availability_rule_weekly CHECK (rule_type <> 'WEEKLY' OR (
        weekday IS NOT NULL AND open_time IS NOT NULL AND close_time IS NOT NULL
        AND weekday BETWEEN 1 AND 7 AND close_time > open_time
        AND start_date IS NULL AND end_date IS NULL AND resource_id IS NULL)),
    CONSTRAINT ck_availability_rule_closure CHECK (rule_type <> 'CLOSURE' OR (
        start_date IS NOT NULL AND end_date IS NOT NULL AND end_date >= start_date
        AND weekday IS NULL AND open_time IS NULL AND close_time IS NULL))
);
CREATE INDEX idx_availability_rule_venue_type_status ON availability_rule (venue_id, rule_type, status);

-- 3.5 reservation
CREATE TABLE reservation (
    id            BIGINT GENERATED ALWAYS AS IDENTITY,
    user_id       BIGINT       NOT NULL,
    resource_id   BIGINT       NOT NULL,
    service_date  DATE         NOT NULL,
    start_time    TIME         NOT NULL,
    end_time      TIME         NOT NULL,
    status        VARCHAR(20)  NOT NULL DEFAULT 'CONFIRMED',
    purpose       VARCHAR(200),
    created_at    TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT now(),
    cancelled_at  TIMESTAMP,
    cancelled_by  BIGINT,
    cancel_reason VARCHAR(200),
    admin_note    VARCHAR(200),
    CONSTRAINT pk_reservation PRIMARY KEY (id),
    CONSTRAINT fk_reservation_user FOREIGN KEY (user_id) REFERENCES app_user (id),
    CONSTRAINT fk_reservation_resource FOREIGN KEY (resource_id) REFERENCES resource (id),
    CONSTRAINT fk_reservation_cancelled_by FOREIGN KEY (cancelled_by) REFERENCES app_user (id),
    CONSTRAINT ck_reservation_time_order CHECK (end_time > start_time),
    CONSTRAINT ck_reservation_status CHECK (status IN
        ('CONFIRMED', 'COMPLETED', 'CANCELLED', 'ADMIN_CANCELLED', 'NO_SHOW'))
);

-- 占用唯一性（先来先得的最终保证）：同一场地同一日期同一时段至多一个有效预约，取消后释放。
CREATE UNIQUE INDEX uq_reservation_active_slot
    ON reservation (resource_id, service_date, start_time)
    WHERE status NOT IN ('CANCELLED', 'ADMIN_CANCELLED');
CREATE INDEX idx_reservation_user_date ON reservation (user_id, service_date);
CREATE INDEX idx_reservation_resource_date ON reservation (resource_id, service_date);
CREATE INDEX idx_reservation_status_date ON reservation (status, service_date);

-- 3.6 usage_record（每个预约至多一条）
CREATE TABLE usage_record (
    id             BIGINT GENERATED ALWAYS AS IDENTITY,
    reservation_id BIGINT    NOT NULL,
    check_in_at    TIMESTAMP NOT NULL,
    check_out_at   TIMESTAMP,
    CONSTRAINT pk_usage_record PRIMARY KEY (id),
    CONSTRAINT fk_usage_record_reservation FOREIGN KEY (reservation_id) REFERENCES reservation (id),
    CONSTRAINT uq_usage_record_reservation UNIQUE (reservation_id),
    CONSTRAINT ck_usage_record_times CHECK (check_out_at IS NULL OR check_out_at >= check_in_at)
);

-- 3.7 announcement
CREATE TABLE announcement (
    id           BIGINT GENERATED ALWAYS AS IDENTITY,
    scope        VARCHAR(10)   NOT NULL,
    venue_id     BIGINT,
    title        VARCHAR(100)  NOT NULL,
    content      VARCHAR(2000) NOT NULL,
    status       VARCHAR(10)   NOT NULL DEFAULT 'ACTIVE',
    published_by BIGINT        NOT NULL,
    published_at TIMESTAMP     NOT NULL DEFAULT now(),
    expires_at   TIMESTAMP,
    CONSTRAINT pk_announcement PRIMARY KEY (id),
    CONSTRAINT fk_announcement_venue FOREIGN KEY (venue_id) REFERENCES venue (id),
    CONSTRAINT fk_announcement_published_by FOREIGN KEY (published_by) REFERENCES app_user (id),
    CONSTRAINT ck_announcement_scope CHECK (scope IN ('SYSTEM', 'VENUE')),
    CONSTRAINT ck_announcement_status CHECK (status IN ('ACTIVE', 'ARCHIVED')),
    CONSTRAINT ck_announcement_scope_venue CHECK (
        (scope = 'SYSTEM' AND venue_id IS NULL) OR (scope = 'VENUE' AND venue_id IS NOT NULL))
);
CREATE INDEX idx_announcement_scope_status_published ON announcement (scope, status, published_at DESC);
CREATE INDEX idx_announcement_venue_status ON announcement (venue_id, status);

-- 3.8 repair_report
CREATE TABLE repair_report (
    id          BIGINT GENERATED ALWAYS AS IDENTITY,
    venue_id    BIGINT       NOT NULL,
    resource_id BIGINT,
    reporter_id BIGINT       NOT NULL,
    description VARCHAR(500) NOT NULL,
    status      VARCHAR(15)  NOT NULL DEFAULT 'SUBMITTED',
    result_note VARCHAR(500),
    handled_by  BIGINT,
    created_at  TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT now(),
    CONSTRAINT pk_repair_report PRIMARY KEY (id),
    CONSTRAINT fk_repair_report_venue FOREIGN KEY (venue_id) REFERENCES venue (id),
    CONSTRAINT fk_repair_report_resource FOREIGN KEY (resource_id) REFERENCES resource (id),
    CONSTRAINT fk_repair_report_reporter FOREIGN KEY (reporter_id) REFERENCES app_user (id),
    CONSTRAINT fk_repair_report_handled_by FOREIGN KEY (handled_by) REFERENCES app_user (id),
    CONSTRAINT ck_repair_report_status CHECK (status IN ('SUBMITTED', 'IN_PROGRESS', 'RESOLVED'))
);

-- 3.9 admin_venue_scope
CREATE TABLE admin_venue_scope (
    id         BIGINT GENERATED ALWAYS AS IDENTITY,
    admin_id   BIGINT      NOT NULL,
    venue_id   BIGINT      NOT NULL,
    status     VARCHAR(10) NOT NULL DEFAULT 'ACTIVE',
    valid_from DATE,
    valid_to   DATE,
    granted_by BIGINT      NOT NULL,
    granted_at TIMESTAMP   NOT NULL DEFAULT now(),
    CONSTRAINT pk_admin_venue_scope PRIMARY KEY (id),
    CONSTRAINT fk_admin_venue_scope_admin FOREIGN KEY (admin_id) REFERENCES app_user (id),
    CONSTRAINT fk_admin_venue_scope_venue FOREIGN KEY (venue_id) REFERENCES venue (id),
    CONSTRAINT fk_admin_venue_scope_granted_by FOREIGN KEY (granted_by) REFERENCES app_user (id),
    CONSTRAINT uq_admin_venue_scope_admin_venue UNIQUE (admin_id, venue_id),
    CONSTRAINT ck_admin_venue_scope_status CHECK (status IN ('ACTIVE', 'REVOKED'))
);

-- 3.10 admin_operation_log（只增不改）
CREATE TABLE admin_operation_log (
    id              BIGINT GENERATED ALWAYS AS IDENTITY,
    admin_id        BIGINT      NOT NULL,
    venue_id        BIGINT,
    action          VARCHAR(40) NOT NULL,
    target_type     VARCHAR(20) NOT NULL,
    target_id       BIGINT,
    reason          VARCHAR(200),
    before_snapshot JSONB,
    after_snapshot  JSONB,
    created_at      TIMESTAMP   NOT NULL DEFAULT now(),
    CONSTRAINT pk_admin_operation_log PRIMARY KEY (id),
    CONSTRAINT fk_admin_operation_log_admin FOREIGN KEY (admin_id) REFERENCES app_user (id),
    CONSTRAINT fk_admin_operation_log_venue FOREIGN KEY (venue_id) REFERENCES venue (id),
    CONSTRAINT ck_admin_operation_log_action CHECK (action IN (
        'RESERVATION_CANCEL', 'RESERVATION_REASSIGN_RESOURCE', 'RESERVATION_REASSIGN_USER',
        'RESOURCE_STATUS_CHANGE', 'RESOURCE_COUNT_CHANGE', 'VENUE_UPDATE', 'RULE_WEEKLY_UPDATE',
        'CLOSURE_ADD', 'CLOSURE_REMOVE', 'SCOPE_UPDATE', 'USER_CREATE', 'USER_STATUS_CHANGE',
        'ANNOUNCEMENT_PUBLISH', 'ANNOUNCEMENT_ARCHIVE', 'REPAIR_UPDATE')),
    CONSTRAINT ck_admin_operation_log_target_type CHECK (target_type IN (
        'RESERVATION', 'RESOURCE', 'VENUE', 'RULE', 'USER', 'SCOPE', 'ANNOUNCEMENT', 'REPAIR'))
);
CREATE INDEX idx_admin_operation_log_venue_created ON admin_operation_log (venue_id, created_at DESC);
CREATE INDEX idx_admin_operation_log_admin_created ON admin_operation_log (admin_id, created_at DESC);
