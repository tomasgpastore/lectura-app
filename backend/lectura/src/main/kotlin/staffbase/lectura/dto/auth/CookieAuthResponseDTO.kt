package staffbase.lectura.dto.auth

data class CookieAuthResponseDTO(
    val csrfToken: String,
    val user: UserResponseDTO
)