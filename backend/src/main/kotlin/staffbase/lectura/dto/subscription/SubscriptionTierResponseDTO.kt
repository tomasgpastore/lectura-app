package staffbase.lectura.dto.subscription

data class SubscriptionTierResponseDTO(
    val id: String,
    val name: String,
    val displayName: String,
    val description: String?,
    val features: List<String>,
    val price: Double,
    val currency: String,
    val interval: String
)