-- 演示种子数据（仅 demo profile 追加执行），内容对应 docs/13 第 5.1–5.4 节。
-- 演示预约不写在这里：预约日期要相对“今天”，由后续工作包的 DemoReservationSeeder 创建（docs/13 第 5.5 节）。
-- id 约定（与前端 mock 种子一致）：场馆 1–3；用户 1–7 按 docs/13 第 5.3 节表序；
-- 场地 1–4 网球场、5–10 羽毛球场、11–16 泳道。除场馆外，其余 id 靠插入顺序产生。

-- 5.1 场馆：id 须与文档一致，所以显式写入；随后把标识列的序列推进到最大 id 之后，保证后续插入不冲突。
INSERT INTO venue (id, name, venue_type, user_booking_enabled)
OVERRIDING SYSTEM VALUE
VALUES (1, '网球馆', 'TENNIS', true),
       (2, '羽毛球馆', 'BADMINTON', false),
       (3, '游泳馆', 'SWIMMING', false);
SELECT setval(pg_get_serial_sequence('venue', 'id'), (SELECT max(id) FROM venue));

-- 5.3 演示账号（口令均为演示口令，库里只存 BCrypt 哈希；真实环境必须改口令）
INSERT INTO app_user (username, password_hash, display_name, role, user_type)
VALUES ('zhangsan', '$2b$10$fK0snUF0HgvlU06WMa7MFuqTi.DBhFxZzLppYEzhG.rYIapTUbn2m', '张三', 'USER', 'STUDENT'),
       ('lisi', '$2b$10$fK0snUF0HgvlU06WMa7MFuqTi.DBhFxZzLppYEzhG.rYIapTUbn2m', '李四', 'USER', 'STUDENT'),
       ('wangwu', '$2b$10$fK0snUF0HgvlU06WMa7MFuqTi.DBhFxZzLppYEzhG.rYIapTUbn2m', '王五', 'USER', 'TEACHER'),
       ('zhaoliu', '$2b$10$fK0snUF0HgvlU06WMa7MFuqTi.DBhFxZzLppYEzhG.rYIapTUbn2m', '赵六', 'USER', 'STUDENT'),
       ('admin_tennis', '$2b$10$fK0snUF0HgvlU06WMa7MFuqTi.DBhFxZzLppYEzhG.rYIapTUbn2m', '网球馆管理员',
        'VENUE_ADMIN', 'OTHER'),
       ('admin_pool', '$2b$10$fK0snUF0HgvlU06WMa7MFuqTi.DBhFxZzLppYEzhG.rYIapTUbn2m', '游泳羽毛球馆管理员',
        'VENUE_ADMIN', 'OTHER'),
       ('sysadmin', '$2b$10$fK0snUF0HgvlU06WMa7MFuqTi.DBhFxZzLppYEzhG.rYIapTUbn2m', '系统管理员',
        'SYS_ADMIN', 'OTHER');

-- 5.1 场地：sort_order 与名称编号一致
INSERT INTO resource (venue_id, name, resource_type, sort_order)
VALUES (1, '网球场1', 'COURT', 1),
       (1, '网球场2', 'COURT', 2),
       (1, '网球场3', 'COURT', 3),
       (1, '网球场4', 'COURT', 4),
       (2, '羽毛球场1', 'COURT', 1),
       (2, '羽毛球场2', 'COURT', 2),
       (2, '羽毛球场3', 'COURT', 3),
       (2, '羽毛球场4', 'COURT', 4),
       (2, '羽毛球场5', 'COURT', 5),
       (2, '羽毛球场6', 'COURT', 6),
       (3, '泳道1', 'LANE', 1),
       (3, '泳道2', 'LANE', 2),
       (3, '泳道3', 'LANE', 3),
       (3, '泳道4', 'LANE', 4),
       (3, '泳道5', 'LANE', 5),
       (3, '泳道6', 'LANE', 6);

-- 5.2 每周开放窗口：星期 1–7，网球馆与羽毛球馆 08:00–20:00，游泳馆 09:00–21:00
INSERT INTO availability_rule (venue_id, rule_type, weekday, open_time, close_time)
SELECT w.venue_id, 'WEEKLY', d.weekday, w.open_time, w.close_time
FROM (VALUES (1, TIME '08:00', TIME '20:00'),
             (2, TIME '08:00', TIME '20:00'),
             (3, TIME '09:00', TIME '21:00')) AS w (venue_id, open_time, close_time)
         CROSS JOIN generate_series(1, 7) AS d (weekday)
ORDER BY w.venue_id, d.weekday;

-- 5.3 授权场馆：网球馆管理员 → 网球馆；游泳羽毛球馆管理员 → 羽毛球馆、游泳馆；系统管理员不受限，没有授权行
INSERT INTO admin_venue_scope (admin_id, venue_id, granted_by)
SELECT a.id, s.venue_id, g.id
FROM (VALUES ('admin_tennis', 1), ('admin_pool', 2), ('admin_pool', 3)) AS s (username, venue_id)
         JOIN app_user a ON a.username = s.username
         CROSS JOIN (SELECT id FROM app_user WHERE username = 'sysadmin') AS g
ORDER BY s.venue_id;

-- 5.4 公告：1 条系统公告 + 1 条网球馆公告（正文与标题相同）
INSERT INTO announcement (scope, venue_id, title, content, published_by)
SELECT 'SYSTEM', NULL, '欢迎使用校园场馆预约系统', '欢迎使用校园场馆预约系统', id
FROM app_user WHERE username = 'sysadmin';
INSERT INTO announcement (scope, venue_id, title, content, published_by)
SELECT 'VENUE', 1, '场地保养：每周一 08:00–09:30 视情况关闭 1 片球场',
       '场地保养：每周一 08:00–09:30 视情况关闭 1 片球场', id
FROM app_user WHERE username = 'admin_tennis';
