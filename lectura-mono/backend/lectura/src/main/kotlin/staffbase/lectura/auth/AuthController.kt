package staffbase.lectura.auth

import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import staffbase.lectura.dto.auth.AuthResponseDTO
import staffbase.lectura.dto.auth.GoogleLoginRequestDTO
import staffbase.lectura.dto.auth.LogoutRequestDTO
import staffbase.lectura.dto.auth.RefreshRequestDTO
import org.slf4j.LoggerFactory
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestHeader
import staffbase.lectura.dto.auth.UserResponseDTO

@RestController
@RequestMapping("/auth")
class AuthController(
    private val authService: AuthService,

){
    private val logger = LoggerFactory.getLogger(this::class.java)

    @PostMapping("/google")
    @ResponseStatus(HttpStatus.OK)
    fun logInWithGoogle(@RequestBody request: GoogleLoginRequestDTO): AuthResponseDTO {
        logger.info("Received Google login request with ID token: ${request.idToken}")
        return authService.loginWithGoogle(request.idToken)
    }

    @PostMapping("/refresh")
    @ResponseStatus(HttpStatus.OK)
    fun refreshToken(@RequestBody request: RefreshRequestDTO): AuthResponseDTO {
        return authService.refreshToken(request.refreshToken)
    }

    @PostMapping("/logout")
    @ResponseStatus(HttpStatus.OK)
    fun logout(@RequestBody request: LogoutRequestDTO) {
        return authService.logout(request.refreshToken)
    }

    @GetMapping("/me")
    @ResponseStatus(HttpStatus.OK)
    fun getCurrentUser(@RequestHeader("Authorization") accessToken: String): UserResponseDTO {
        return authService.getCurrentUser(accessToken)
    }
}