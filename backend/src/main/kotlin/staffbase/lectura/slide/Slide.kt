package staffbase.lectura.slide

import org.bson.types.ObjectId
import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document
import java.time.Instant
import java.time.LocalDateTime
import java.util.UUID

@Document(collection = "slides")
data class Slide(
    @Id
    val id: String = UUID.randomUUID().toString(),
    var originalFileName: String,
    val contentType: String,
    val fileSize: Long,
    val storageFileName: String, // argument for ai service
    val courseId: String, // argument for ai service
    val pageCount: Int,
    val uploadTimestamp: Instant = Instant.now(),
)

/*
@Document("chunks")
data class Chunk(
    @Id val id: String = UUID.randomUUID().toString(),
    val slideId: String,
    val pageNumber: Int,
    val text: String,
    var embedding: List<Double>? = null
)
*/