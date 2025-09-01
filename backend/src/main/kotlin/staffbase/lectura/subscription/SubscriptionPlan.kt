package staffbase.lectura.subscription

enum class SubscriptionPlan {
    FREE,
    PREMIUM
}

data class PlanLimits(
    val maxCourses: Int,
    val maxFilesPerCourse: Int,
    val maxMessagesPerDay: Int?,
    val allowedSearchTypes: Set<String>
)

object SubscriptionLimits {
    val limits = mapOf(
        SubscriptionPlan.FREE to PlanLimits(
            maxCourses = 2,
            maxFilesPerCourse = 2,
            maxMessagesPerDay = 10,
            allowedSearchTypes = setOf("DEFAULT", "RAG")
        ),
        SubscriptionPlan.PREMIUM to PlanLimits(
            maxCourses = 10,
            maxFilesPerCourse = 20,
            maxMessagesPerDay = null, // unlimited
            allowedSearchTypes = setOf("DEFAULT", "RAG", "WEB", "RAG_WEB")
        )
    )
    
    fun getLimits(plan: SubscriptionPlan): PlanLimits {
        return limits[plan] ?: limits[SubscriptionPlan.FREE]!!
    }
}