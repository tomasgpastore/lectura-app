package staffbase.lectura

import org.springframework.boot.autoconfigure.SpringBootApplication
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.runApplication
import staffbase.lectura.config.JwtConfig
import staffbase.lectura.config.GoogleConfig

@SpringBootApplication
@EnableConfigurationProperties(
	value = [JwtConfig::class, GoogleConfig::class]
)
class LecturaApplication

fun main(args: Array<String>) {
	runApplication<LecturaApplication>(*args)
}
