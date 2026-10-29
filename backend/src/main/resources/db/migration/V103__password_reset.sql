-- 自助找回密码（契约 v1.3，SEC-2b）：docs/13 第 3.1 节 password_changed_at 与第 3.9a 节 password_reset_attempt。
-- password_changed_at 为空表示从未自助重置；早于它签发的 Token 由认证过滤器拒绝（TOKEN_EXPIRED）。
-- password_reset_attempt 按请求中的用户名字符串记录，不设外键，使不存在的用户名与真实账号表现一致。
ALTER TABLE app_user
    ADD COLUMN password_changed_at TIMESTAMP;

CREATE TABLE password_reset_attempt (
    id           BIGINT GENERATED ALWAYS AS IDENTITY,
    username     VARCHAR(32) NOT NULL,
    attempted_at TIMESTAMP   NOT NULL,
    succeeded    BOOLEAN     NOT NULL,
    CONSTRAINT pk_password_reset_attempt PRIMARY KEY (id)
);

CREATE INDEX idx_password_reset_attempt_username_attempted ON password_reset_attempt (username, attempted_at);
