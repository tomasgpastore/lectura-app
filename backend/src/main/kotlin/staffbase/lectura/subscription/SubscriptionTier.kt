package staffbase.lectura.subscription

import org.springframework.data.annotation.Id
import org.springframework.data.mongodb.core.mapping.Document

@Document(collection = "subscription_tiers")
data class SubscriptionTierDocument(
    @Id
    val id: String? = null,
    val name: String,
    val stripePriceId: String,
    val displayName: String,
    val description: String? = null,
    val features: List<String> = emptyList(),
    val price: Double,
    val currency: String = "USD",
    val interval: String = "month", // month, year
    val isActive: Boolean = true
)