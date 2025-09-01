package staffbase.lectura.controller

import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import org.springframework.security.core.context.SecurityContextHolder

@RestController
@RequestMapping("/api/test")
class TestController {
    
    @GetMapping("/public")
    fun publicEndpoint(): Map<String, String> {
        return mapOf(
            "message" to "This is a public endpoint",
            "authenticated" to (SecurityContextHolder.getContext().authentication != null).toString()
        )
    }
    
    @GetMapping("/protected")
    fun protectedEndpoint(): Map<String, String> {
        val auth = SecurityContextHolder.getContext().authentication
        return mapOf(
            "message" to "This is a protected endpoint",
            "userId" to (auth?.principal?.toString() ?: "unknown"),
            "authenticated" to auth.isAuthenticated.toString()
        )
    }
    
    @PostMapping("/csrf-test")
    fun csrfTestEndpoint(@RequestBody data: Map<String, String>): Map<String, String> {
        return mapOf(
            "message" to "CSRF validation passed",
            "received" to data.toString()
        )
    }
}