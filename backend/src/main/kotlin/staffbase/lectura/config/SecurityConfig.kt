package staffbase.lectura.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.web.SecurityFilterChain
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource
import staffbase.lectura.filter.CookieAuthenticationFilter
import staffbase.lectura.filter.CsrfValidationFilter

@Configuration
class SecurityConfig(
    private val cookieAuthenticationFilter: CookieAuthenticationFilter,
    private val csrfValidationFilter: CsrfValidationFilter
) {

    @Bean
    fun corsConfigurationSource(): CorsConfigurationSource {
        val configuration = CorsConfiguration()
        configuration.allowedOrigins = listOf("http://localhost:3000")
        configuration.allowedMethods = listOf("GET", "POST", "DELETE", "PATCH", "PUT", "OPTIONS")
        configuration.allowedHeaders = listOf("*")
        configuration.exposedHeaders = listOf("X-CSRF-Token")
        configuration.allowCredentials = true
        
        val source = UrlBasedCorsConfigurationSource()
        source.registerCorsConfiguration("/**", configuration)
        return source
    }

    @Bean
    fun securityFilterChain(http: HttpSecurity): SecurityFilterChain {
        http
            .cors { it.configurationSource(corsConfigurationSource()) }
            .csrf { it.disable() } // We're using our custom CSRF implementation
            .authorizeHttpRequests {
                it.requestMatchers("/docs/**").permitAll()
                it.requestMatchers("/auth/**").permitAll()
                it.requestMatchers("/health/**").permitAll()
                it.requestMatchers("/actuator/**").permitAll()
                it.requestMatchers("/api/subscription/webhook").permitAll()
                  .anyRequest().authenticated()
            }
            .exceptionHandling {
                it.authenticationEntryPoint { _, response, _ ->
                    response.status = HttpStatus.UNAUTHORIZED.value()
                    response.contentType = "application/json"
                    response.writer.write("{\"error\": \"Unauthorized\", \"message\": \"Authentication required\"}")
                }
            }
            .addFilterBefore(cookieAuthenticationFilter, UsernamePasswordAuthenticationFilter::class.java)
            .addFilterAfter(csrfValidationFilter, CookieAuthenticationFilter::class.java)

        return http.build()
    }
}
