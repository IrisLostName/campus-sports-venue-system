package com.campus.venue.common.config;

import com.campus.venue.common.web.NulParameterInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

/** MVC 配置：注册全局的查询参数与路径变量 U+0000 检查（BE-3 裁决 G4）。 */
@Configuration(proxyBeanMethods = false)
public class WebMvcConfig implements WebMvcConfigurer {

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new NulParameterInterceptor());
    }
}
