package staffbase.lectura.dao

import staffbase.lectura.subscription.SubscriptionTierDocument

interface SubscriptionTierDAO {
    suspend fun findByName(name: String): SubscriptionTierDocument?
    suspend fun findById(id: String): SubscriptionTierDocument?
    suspend fun findAll(): List<SubscriptionTierDocument>
    suspend fun save(tier: SubscriptionTierDocument): SubscriptionTierDocument
    suspend fun deleteById(id: String): Boolean
}