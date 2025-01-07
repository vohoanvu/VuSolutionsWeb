using Microsoft.AspNetCore.Identity;

namespace VuSolutionsWeb.Models
{
    public class ApplicationUser : IdentityUser
    {
        public virtual Organization? Organization { get; set; }
        public int? OrganizationId { get; set; }
        public double DevityTimeToLive { get; set; }
        public bool IsTNCAccepted { get; set; }
        public DateTime TNCAcceptedOn { get; set; }
    }
}