package staffbase.lectura.user

import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document
import staffbase.lectura.auth.AuthProvider
import java.time.Instant

@Document(collection = "users")
data class User(
    @Id
    val id: String,
    val provider: AuthProvider,
    val providerId: String,
    val email: String,
    val courseId: List<String>,
    val picture: String,
    val createdAt: Instant = Instant.now(),
)