package staffbase.lectura.config

import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.core.convert.converter.Converter
import org.springframework.data.mongodb.core.convert.MongoCustomConversions
import java.time.Instant

@Configuration
class MongoConfig {

    @Bean
    fun mongoCustomConversions(): MongoCustomConversions {
        return MongoCustomConversions(
            listOf(
                LongToInstantConverter(),
                InstantToLongConverter()
            )
        )
    }

    private class LongToInstantConverter : Converter<Long, Instant> {
        override fun convert(source: Long): Instant {
            return Instant.ofEpochMilli(source)
        }
    }

    private class InstantToLongConverter : Converter<Instant, Long> {
        override fun convert(source: Instant): Long {
            return source.toEpochMilli()
        }
    }
}
