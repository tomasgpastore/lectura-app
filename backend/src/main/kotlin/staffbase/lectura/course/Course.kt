package staffbase.lectura.course

import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document
import java.time.Instant

@Document(collection = "courses")
data class Course(
    @Id val id: String,
    val slideId: List<String>,
    var code: String,
    var name: String,
    var summary: String? = null,
    var deletedAt: Instant? = null,
)