package staffbase.lectura.auth

import com.google.api.client.googleapis.auth.oauth2.GoogleIdToken
import com.google.api.client.googleapis.auth.oauth2.GoogleIdTokenVerifier
import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport
import org.springframework.stereotype.Service
import staffbase.lectura.config.GoogleConfig
import com.google.api.client.json.gson.GsonFactory

@Service
class GoogleVerifierService(private val googleConfig: GoogleConfig) {

    private val transport = GoogleNetHttpTransport.newTrustedTransport()
    private val gsonFactory = GsonFactory.getDefaultInstance()

    private val verifier = GoogleIdTokenVerifier.Builder(transport, gsonFactory)
        .setAudience(listOf(googleConfig.clientId))
        .build()

    fun verify(idTokenString: String): GoogleIdToken.Payload {
        val idToken: GoogleIdToken? = verifier.verify(idTokenString)
        if (idToken == null) {
            throw IllegalArgumentException("Invalid Google ID token")
        }
        return idToken.payload
    }
}
