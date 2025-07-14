package staffbase.lectura.auth

import org.springframework.stereotype.Service
import com.auth0.jwt.JWT
import com.auth0.jwt.JWTVerifier
import com.auth0.jwt.algorithms.Algorithm
import com.auth0.jwt.exceptions.JWTVerificationException
import com.auth0.jwt.interfaces.DecodedJWT
import staffbase.lectura.config.JwtConfig
import java.time.Instant
import java.time.temporal.ChronoUnit
import org.springframework.security.authentication.BadCredentialsException


@Service
class JwtService(private val jwtConfig: JwtConfig) {

    private val algorithm = Algorithm.HMAC256(jwtConfig.secret)
    private val verifier: JWTVerifier = JWT.require(algorithm)
        .withIssuer(jwtConfig.issuer)
        .build()


    fun createAccessToken(userId: String): String {
        val now = Instant.now()
        val expiry = now.plus(jwtConfig.accessTokenExpirationMinutes, ChronoUnit.MINUTES)

        return JWT.create()
            .withIssuer(jwtConfig.issuer)
            .withSubject(userId)
            .withIssuedAt(now)
            .withExpiresAt(expiry)
            .sign(algorithm)
    }

    fun parseAccessToken(token: String): DecodedJWT {
        try {
            return verifier.verify(token)
        } catch (e: JWTVerificationException) {
            throw BadCredentialsException("Invalid or expired access token", e)
        }
    }

    fun extractUserIdFromHeader(authHeader: String): String {
        val token = authHeader.removePrefix("Bearer ").trim()
        return parseAccessToken(token).subject
    }

}