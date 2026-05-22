package com.hermes.backend;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Sort;

import java.util.List;

public record AdminPagedResponse<T>(
        List<T> items,
        int page,
        int size,
        long totalItems,
        int totalPages,
        String sortBy,
        String sortDirection
) {
    public static <T> AdminPagedResponse<T> from(Page<T> page, Sort sort) {
        Sort.Order order = sort.iterator().hasNext() ? sort.iterator().next() : Sort.Order.asc("id");
        return new AdminPagedResponse<>(
                page.getContent(),
                page.getNumber(),
                page.getSize(),
                page.getTotalElements(),
                page.getTotalPages(),
                order.getProperty(),
                order.getDirection().name().toLowerCase()
        );
    }
}
