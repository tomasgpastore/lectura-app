package staffbase.lectura.exception

import staffbase.lectura.subscription.SubscriptionPlan

class SubscriptionLimitException(
    val reason: String,
    val limit: Int? = null,
    val current: Int? = null,
    val requiredPlan: SubscriptionPlan? = null
) : RuntimeException(reason)