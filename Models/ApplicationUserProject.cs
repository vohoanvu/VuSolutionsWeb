namespace VuSolutionsWeb.Models
{
    public partial class ApplicationUserProject
    {
        public required string UserId { get; set; }
        public virtual required ApplicationUser User { get; set; }

        public int ProjectId { get; set; }
        public virtual required Project Project { get; set; }
    }
}