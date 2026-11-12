package com.zoroacademy.config;

import com.zoroacademy.security.JwtAuthenticationEntryPoint;
import com.zoroacademy.security.JwtAuthenticationFilter;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;

@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthenticationFilter;
    private final JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthenticationFilter, JwtAuthenticationEntryPoint jwtAuthenticationEntryPoint) {
        this.jwtAuthenticationFilter = jwtAuthenticationFilter;
        this.jwtAuthenticationEntryPoint = jwtAuthenticationEntryPoint;
    }

    @Value("${cors.allowed-origins:http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173}")
    private String allowedOrigins;

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration) throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    @Bean
    @org.springframework.core.annotation.Order(1)
    public SecurityFilterChain filesFilterChain(HttpSecurity http) throws Exception {
        String allowedOriginsCsp = String.join(" ", allowedOrigins.split(","));
        http
                .securityMatcher("/api/files/**")
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .headers(headers -> headers
                        .frameOptions(org.springframework.security.config.annotation.web.configurers.HeadersConfigurer.FrameOptionsConfig::disable)
                        .contentSecurityPolicy(csp -> csp
                                .policyDirectives("frame-ancestors 'self' " + allowedOriginsCsp)
                        )
                )
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding("UTF-8");
                            Map<String, Object> body = new HashMap<>();
                            body.put("success", false);
                            body.put("code", "FORBIDDEN");
                            body.put("message", "Access denied: insufficient permissions");
                            new com.fasterxml.jackson.databind.ObjectMapper().writeValue(response.getWriter(), body);
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.GET, "/api/files/**").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/api/files/**").permitAll()
                        .anyRequest().authenticated()
                );

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    @org.springframework.core.annotation.Order(2)
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .exceptionHandling(exception -> exception
                        .authenticationEntryPoint(jwtAuthenticationEntryPoint)
                        .accessDeniedHandler((request, response, accessDeniedException) -> {
                            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
                            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
                            response.setCharacterEncoding("UTF-8");
                            Map<String, Object> body = new HashMap<>();
                            body.put("success", false);
                            body.put("code", "FORBIDDEN");
                            body.put("message", "Access denied: insufficient permissions");
                            new com.fasterxml.jackson.databind.ObjectMapper().writeValue(response.getWriter(), body);
                        })
                )
                .authorizeHttpRequests(auth -> auth
                        // 1. Strictly Public Endpoints
                        .requestMatchers("/error").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/time", "/api/auth/check-email").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/enquiries", "/api/enquiries/").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/courses/*/students").hasAnyRole("ADMIN", "SUPER_ADMIN", "TRAINER")
                        .requestMatchers(HttpMethod.GET, "/api/courses/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/files/**").permitAll()
                        .requestMatchers(HttpMethod.HEAD, "/api/files/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/website-settings/**").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/feedback-media/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/competitions/{id}/registrations").permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/competitions", "/api/competitions/", "/api/competitions/{id}", "/api/competitions/{id}/modules").permitAll()
                        .requestMatchers("/api/payments/razorpay/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/webhooks/**").permitAll()
                        .requestMatchers("/swagger-ui/**", "/v3/api-docs/**", "/swagger-ui.html").permitAll()

                        // 2. ADMIN Role Specific Endpoints
                        .requestMatchers("/api/admin/**").hasRole("ADMIN")
                        .requestMatchers("/api/dashboard/**").hasRole("ADMIN")
                        .requestMatchers("/api/activity-logs/**").hasRole("ADMIN")
                        .requestMatchers("/api/fees/**").hasRole("ADMIN")
                        .requestMatchers("/api/expenses/**").hasRole("ADMIN")
                        .requestMatchers("/api/salary/**").hasRole("ADMIN")
                        .requestMatchers("/api/settings/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/enquiries/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/enquiries/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/enquiries/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/website-settings/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/website-settings/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/website-settings/**").hasRole("ADMIN")
                        .requestMatchers("/api/enrollments/requests/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/trainers/dashboard-stats", "/api/trainers/dashboard-stats/**", "/api/trainer/dashboard-stats", "/api/trainer/dashboard-stats/**").hasAnyRole("ADMIN", "TRAINER", "SUPER_ADMIN")
                        .requestMatchers("/api/trainers/{id}/replace").hasRole("ADMIN")
                        .requestMatchers("/api/trainers/**", "/api/trainer/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/courses/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/courses/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/courses/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/batches/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/batches/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/batches/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/competitions", "/api/competitions/*/modules", "/api/competitions/*/syllabus", "/api/competitions/*/guidance-videos", "/api/competitions/*/study-materials", "/api/competitions/assessments/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/competitions/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/competitions/**").hasRole("ADMIN")
                        .requestMatchers("/api/competitions/registrations", "/api/competitions/registrations/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/competitions/{id}/registrations").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.GET, "/api/users/students", "/api/users/trainers").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.POST, "/api/users/students", "/api/users/trainers").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.PUT, "/api/users/students/**", "/api/users/trainers/**").hasRole("ADMIN")
                        .requestMatchers(HttpMethod.DELETE, "/api/users/**").hasRole("ADMIN")

                        // 3. TRAINER or ADMIN Endpoints
                        .requestMatchers(HttpMethod.GET, "/api/batches/**").hasAnyRole("ADMIN", "TRAINER")
                        .requestMatchers(HttpMethod.POST, "/api/schedules/*/join").authenticated()
                        .requestMatchers(HttpMethod.GET, "/api/schedules", "/api/schedules/").authenticated()
                        .requestMatchers("/api/schedules/**").hasAnyRole("ADMIN", "TRAINER")
                        .requestMatchers(HttpMethod.GET, "/api/attendance/student/**").authenticated()
                        .requestMatchers("/api/attendance/**").hasAnyRole("ADMIN", "TRAINER")
                        .requestMatchers(HttpMethod.POST, "/api/assignments").hasAnyRole("ADMIN", "TRAINER")
                        .requestMatchers(HttpMethod.PUT, "/api/assignments/**").hasAnyRole("ADMIN", "TRAINER")
                        .requestMatchers(HttpMethod.DELETE, "/api/assignments/**").hasAnyRole("ADMIN", "TRAINER")
                        .requestMatchers("/api/submissions/*/review", "/api/submissions/*/review/**", "/api/submissions/review/**").hasAnyRole("ADMIN", "TRAINER")

                        // 4. Any other authenticated request (e.g. /api/auth/me, /api/users/password, student progress, playback)
                        .anyRequest().authenticated()
                );

        http.addFilterBefore(jwtAuthenticationFilter, UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        List<String> origins = Arrays.asList(allowedOrigins.split(","));
        configuration.setAllowedOrigins(origins);
        configuration.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(Arrays.asList("Authorization", "Content-Type", "X-Requested-With", "Accept", "Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"));
        configuration.setExposedHeaders(Arrays.asList("Access-Control-Allow-Origin", "Access-Control-Allow-Credentials"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
