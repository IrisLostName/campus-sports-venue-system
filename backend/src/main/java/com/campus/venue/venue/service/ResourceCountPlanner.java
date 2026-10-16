package com.campus.venue.venue.service;

import com.campus.venue.common.error.BusinessException;
import com.campus.venue.common.error.ErrorCode;
import com.campus.venue.venue.domain.Resource;
import com.campus.venue.venue.domain.ResourceStatus;
import com.campus.venue.venue.domain.ResourceType;
import java.math.BigInteger;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 设定场地数量的纯计算（docs/09 第 3 节、docs/12 第 5.5 节，BE-2b 裁决 A3；ACC-M3-08）。不查库、不改数据。
 * 做法与 mock resourceService.ts 的 planCount、byNameNumber、nameNumber、nextNumber、planCreation 一致：
 * 编号 = 名称末尾的数字；名称不以数字结尾的场地排在最后（彼此按 id）；count 指非 DISABLED 的场地数。
 */
final class ResourceCountPlanner {

    static final int NAME_MAX = 50;
    static final String REQUIRED_WHEN_EMPTY = "场馆没有场地时必须提供";
    static final String NAME_TOO_LONG = "生成的场地名超过 " + NAME_MAX + " 个字符";
    static final String SORT_ORDER_EXHAUSTED = "排序值已达上限，无法追加场地";
    private static final Pattern TRAILING_DIGITS = Pattern.compile("[0-9]+$");
    private static final Pattern ALL_DIGITS = Pattern.compile("[0-9]+");

    /** 编号从小到大；不以数字结尾的排在最后；同编号或都无编号时按 id。 */
    static final Comparator<Resource> BY_NAME_NUMBER = Comparator
            .comparing(ResourceCountPlanner::nameNumber, Comparator.nullsLast(Comparator.naturalOrder()))
            .thenComparing(Resource::getId);

    private ResourceCountPlanner() {
    }

    /** 待新建的场地。 */
    record NewResource(String name, int sortOrder, ResourceType resourceType) {
    }

    /** 一次设定的变更：重新启用、停用、新建。 */
    record CountChange(List<Resource> toEnable, List<Resource> toDisable, List<NewResource> toCreate) {
    }

    /**
     * existing 为该场馆全部场地（含 DISABLED），按 sortOrder、id 排序。
     * 缩小：把编号最大的多余场地置 DISABLED；增大：先按编号从小到大重新启用 DISABLED 的场地，不足再新建。
     */
    static CountChange plan(List<Resource> existing, int count, String namePrefix, ResourceType resourceType) {
        List<Resource> active = existing.stream()
                .filter(resource -> resource.getOperationalStatus() != ResourceStatus.DISABLED)
                .toList();
        if (count < active.size()) {
            List<Resource> toDisable = active.stream().sorted(BY_NAME_NUMBER.reversed())
                    .limit((long) active.size() - count).toList();
            return new CountChange(List.of(), toDisable, List.of());
        }
        int needed = count - active.size();
        List<Resource> toEnable = existing.stream()
                .filter(resource -> resource.getOperationalStatus() == ResourceStatus.DISABLED)
                .sorted(BY_NAME_NUMBER)
                .limit(needed)
                .toList();
        int remaining = needed - toEnable.size();
        List<NewResource> toCreate = remaining > 0
                ? creation(existing, namePrefix, resourceType, remaining)
                : List.of();
        return new CountChange(toEnable, List.of(), toCreate);
    }

    /** 新建场地的命名前缀与类型。 */
    private record Defaults(String prefix, ResourceType resourceType) {
    }

    /** 新建 needed 个场地：名称为 前缀N（N 从 nextNumber 起递增），sortOrder 从现有最大值 + 1 起递增。 */
    private static List<NewResource> creation(List<Resource> existing, String namePrefix, ResourceType resourceType,
            int needed) {
        Defaults defaults = defaults(existing, namePrefix, resourceType);
        BigInteger next = nextNumber(existing, defaults.prefix());
        int top = Math.max(existing.stream().mapToInt(Resource::getSortOrder).max().orElse(0), 0);
        List<NewResource> created = new ArrayList<>();
        for (int i = 0; i < needed; i++) {
            String name = defaults.prefix() + next.add(BigInteger.valueOf(i));
            if (name.length() > NAME_MAX) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        Map.of("fields", Map.of("namePrefix", NAME_TOO_LONG)));
            }
            // 新场地的 sortOrder 按 long 计算，超出 int 范围时报字段错误而不是溢出（BE-2b 第 10 节、BE-5 K1）
            long sortOrder = (long) top + i + 1;
            if (sortOrder > Integer.MAX_VALUE) {
                throw new BusinessException(ErrorCode.VALIDATION_ERROR,
                        Map.of("fields", Map.of("count", SORT_ORDER_EXHAUSTED)));
            }
            created.add(new NewResource(name, (int) sortOrder, defaults.resourceType()));
        }
        return created;
    }

    /** 前缀缺省取第一个场地名去掉末尾数字的部分，类型缺省取它的类型；场馆没有场地而缺省 → VALIDATION_ERROR。 */
    private static Defaults defaults(List<Resource> existing, String namePrefix, ResourceType resourceType) {
        Resource first = existing.isEmpty() ? null : existing.get(0);
        String prefix = namePrefix;
        ResourceType type = resourceType;
        if (first != null) {
            prefix = prefix != null ? prefix : TRAILING_DIGITS.matcher(first.getName()).replaceFirst("");
            type = type != null ? type : first.getResourceType();
        }
        Map<String, Object> fields = new LinkedHashMap<>();
        if (prefix == null) {
            fields.put("namePrefix", REQUIRED_WHEN_EMPTY);
        }
        if (type == null) {
            fields.put("resourceType", REQUIRED_WHEN_EMPTY);
        }
        if (!fields.isEmpty()) {
            throw new BusinessException(ErrorCode.VALIDATION_ERROR, Map.of("fields", fields));
        }
        return new Defaults(prefix, type);
    }

    /** N = 名称为“前缀 + 纯数字”的场地中的最大数字 + 1（没有则为 1），保证新名称与现有名称不重复。 */
    static BigInteger nextNumber(List<Resource> existing, String prefix) {
        BigInteger max = BigInteger.ZERO;
        for (Resource resource : existing) {
            String name = resource.getName();
            if (name.startsWith(prefix) && ALL_DIGITS.matcher(name.substring(prefix.length())).matches()) {
                max = max.max(new BigInteger(name.substring(prefix.length())));
            }
        }
        return max.add(BigInteger.ONE);
    }

    /** 名称末尾的数字；不以数字结尾时为 null。 */
    static BigInteger nameNumber(Resource resource) {
        Matcher matcher = TRAILING_DIGITS.matcher(resource.getName());
        return matcher.find() ? new BigInteger(matcher.group()) : null;
    }
}
