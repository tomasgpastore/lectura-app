package staffbase.lectura.dto.auth

data class AuthResponseDTO (
    val accessToken: String,
    val refreshToken: String,
)