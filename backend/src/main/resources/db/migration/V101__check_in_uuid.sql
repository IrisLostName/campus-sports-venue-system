-- 扫码签到的随机签到标识（docs/13 第 3.1 节 check_in_uuid，契约 v1.1，P2-1b）。
-- 编号接在演示种子 V100 之后：demo profile 的库已应用 V100，较小的编号会被 Flyway 视为漏跑的迁移而校验失败。
-- gen_random_uuid() 为 PostgreSQL 13 起内置的易变函数，加列时逐行求值，所以已有用户（含演示账号）各得一个不同的值；
-- 之后新建的用户（注册、系统管理员创建）由默认值自动获得。实体不映射该列，任何接口都不返回它（签到码除外）。
ALTER TABLE app_user
    ADD COLUMN check_in_uuid UUID NOT NULL DEFAULT gen_random_uuid();

ALTER TABLE app_user
    ADD CONSTRAINT uq_app_user_check_in_uuid UNIQUE (check_in_uuid);
