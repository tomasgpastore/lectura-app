package staffbase.lectura.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

@Configuration
@ConfigurationProperties(prefix = "jwt")
class JwtConfig {
    lateinit var secret: String
    lateinit var issuer: String
    var accessTokenExpirationMinutes: Long = 60
}