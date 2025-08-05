package staffbase.lectura.subscription

import kotlinx.coroutines.runBlocking
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.web.bind.annotation.*
import jakarta.validation.Valid
import org.slf4j.LoggerFactory
import staffbase.lectura.dto.subscription.*
import staffbase.lectura.auth.AuthenticationService
import jakarta.servlet.http.HttpServletRequest

@RestController
@RequestMapping("/api/subscription")
class SubscriptionController(
    private val subscriptionService: SubscriptionService,
    private val authenticationService: AuthenticationService
) {
    private val logger = LoggerFactory.getLogger(SubscriptionController::class.java)

    @PostMapping("/checkout-session")
    fun createCheckoutSession(
        @Valid @RequestBody dto: CreateCheckoutSessionDTO
    ): ResponseEntity<CheckoutSessionResponseDTO> = runBlocking {
        try {
            val userId = authenticationService.requireCurrentUserId()
            val checkoutUrl = subscriptionService.createCheckoutSession(userId, dto.tierName)
            ResponseEntity.ok(CheckoutSessionResponseDTO(checkoutUrl))
        } catch (e: Exception) {
            logger.error("Error creating checkout session", e)
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build()
        }
    }

    @PostMapping("/billing-portal")
    fun createBillingPortalSession(): ResponseEntity<BillingPortalSessionResponseDTO> = runBlocking {
        try {
            val userId = authenticationService.requireCurrentUserId()
            val billingPortalUrl = subscriptionService.createBillingPortalSession(userId)
            ResponseEntity.ok(BillingPortalSessionResponseDTO(billingPortalUrl))
        } catch (e: Exception) {
            logger.error("Error creating billing portal session", e)
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build()
        }
    }

    @PostMapping("/webhook")
    fun handleStripeWebhook(
        @RequestBody payload: String,
        @RequestHeader("Stripe-Signature") signature: String
    ): ResponseEntity<WebhookEventResponseDTO> = runBlocking {
        try {
            val event = subscriptionService.handleWebhookEvent(payload, signature)
            ResponseEntity.ok(WebhookEventResponseDTO(
                eventId = "webhook_received",
                eventType = "processed",
                processed = true
            ))
        } catch (e: Exception) {
            logger.error("Error handling webhook", e)
            ResponseEntity.status(HttpStatus.BAD_REQUEST).build()
        }
    }

    @GetMapping("/tiers")
    fun getSubscriptionTiers(): ResponseEntity<List<SubscriptionTierResponseDTO>> = runBlocking {
        try {
            val tiers = subscriptionService.getAvailableTiers()
            ResponseEntity.ok(tiers.map { tier ->
                SubscriptionTierResponseDTO(
                    id = tier.id ?: "",
                    name = tier.name,
                    displayName = tier.displayName,
                    description = tier.description,
                    features = tier.features,
                    price = tier.price,
                    currency = tier.currency,
                    interval = tier.interval
                )
            })
        } catch (e: Exception) {
            logger.error("Error fetching subscription tiers", e)
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build()
        }
    }
    
    @GetMapping("/status")
    fun getUserSubscriptionStatus(): ResponseEntity<UserSubscriptionStatusResponseDTO> = runBlocking {
        try {
            val userId = authenticationService.requireCurrentUserId()
            val status = subscriptionService.getUserSubscriptionStatus(userId)
            ResponseEntity.ok(UserSubscriptionStatusResponseDTO(
                hasActiveSubscription = status.hasActiveSubscription,
                subscriptionStatus = status.subscriptionStatus,
                subscriptionTier = status.subscriptionTier,
                subscriptionExpiresAt = status.subscriptionExpiresAt?.toString()
            ))
        } catch (e: Exception) {
            logger.error("Error fetching user subscription status", e)
            ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).build()
        }
    }
}