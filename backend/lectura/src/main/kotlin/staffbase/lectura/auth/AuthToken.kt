package staffbase.lectura.auth

import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document
import java.time.Instant

@Document(collection = "auth")
data class AuthToken (
    @Id val tokenId: String,
    val userId: String,
    val refreshToken: String,
    val createdAt: Instant,
    val expiresAt: Instant,
    val isRevoked: Boolean = false,
)