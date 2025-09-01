package staffbase.lectura.dto.subscription

data class UserSubscriptionStatusResponseDTO(
    val hasActiveSubscription: Boolean,
    val subscriptionStatus: String?,
    val subscriptionTier: String?,
    val subscriptionExpiresAt: String?
)