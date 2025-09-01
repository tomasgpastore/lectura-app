package staffbase.lectura.infrastructure.database.local

import org.springframework.context.annotation.Profile
import org.springframework.stereotype.Repository
import staffbase.lectura.dao.SubscriptionTierDAO
import staffbase.lectura.subscription.SubscriptionTierDocument

@Repository
@Profile("local")
class SubscriptionTierInMemoryDAO : SubscriptionTierDAO {
    
    private val tiers = mutableMapOf<String, SubscriptionTierDocument>()
    
    init {
        // Initialize with default tiers
        val freeTier = SubscriptionTierDocument(
            id = "free",
            name = "free",
            stripePriceId = "price_free",
            displayName = "Free Plan",
            description = "Basic features with limited usage",
            features = listOf(
                "Create up to 2 courses",
                "Upload up to 2 files per course", 
                "10 messages per day",
                "Basic AI search (RAG)"
            ),
            price = 0.0,
            currency = "USD",
            interval = "month",
            isActive = true
        )
        
        val premiumTier = SubscriptionTierDocument(
            id = "premium",
            name = "premium",
            stripePriceId = "price_premium",
            displayName = "Premium Plan",
            description = "Full access with enhanced features",
            features = listOf(
                "Create up to 10 courses",
                "Upload up to 20 files per course",
                "Unlimited messages",
                "Advanced AI search (RAG + Web)"
            ),
            price = 29.99,
            currency = "USD",
            interval = "month",
            isActive = true
        )
        
        tiers[freeTier.id!!] = freeTier
        tiers[premiumTier.id!!] = premiumTier
    }
    
    override suspend fun findByName(name: String): SubscriptionTierDocument? {
        return tiers.values.find { it.name == name }
    }
    
    override suspend fun findById(id: String): SubscriptionTierDocument? {
        return tiers[id]
    }
    
    override suspend fun findAll(): List<SubscriptionTierDocument> {
        return tiers.values.toList()
    }
    
    override suspend fun save(tier: SubscriptionTierDocument): SubscriptionTierDocument {
        val id = tier.id ?: "tier_${System.currentTimeMillis()}"
        val savedTier = tier.copy(id = id)
        tiers[id] = savedTier
        return savedTier
    }
    
    override suspend fun deleteById(id: String): Boolean {
        return tiers.remove(id) != null
    }
}