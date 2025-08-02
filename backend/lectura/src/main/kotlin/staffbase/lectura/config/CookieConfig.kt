package staffbase.lectura.config

import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.context.annotation.Configuration

@Configuration
@ConfigurationProperties(prefix = "app.cookie")
data class CookieConfig(
    var domain: String = "",
    var secure: Boolean = true,
    var httpOnly: Boolean = true,
    var sameSite: String = "Strict",
    var accessTokenName: String = "lectura_access_token",
    var refreshTokenName: String = "lectura_refresh_token",
    var accessTokenMaxAge: Int = 900, // 15 minutes in seconds
    var refreshTokenMaxAge: Int = 2592000, // 30 days in seconds
    var path: String = "/"
) {
    fun isDevelopment(): Boolean {
        return !secure // In development, secure is false
    }
}