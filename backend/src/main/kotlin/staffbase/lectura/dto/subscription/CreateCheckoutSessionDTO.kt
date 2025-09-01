package staffbase.lectura.dto.subscription

import jakarta.validation.constraints.NotBlank

data class CreateCheckoutSessionDTO(
    @field:NotBlank(message = "Tier name is required")
    val tierName: String
)