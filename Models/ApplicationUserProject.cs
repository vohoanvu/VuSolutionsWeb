using System.ComponentModel.DataAnnotations;

namespace VuSolutionsWeb.Models
{
    public partial class ApplicationUserProject
    {
        [Key]
        public int Id { get; set; }

        public required string UserId { get; set; }
        public virtual required ApplicationUser User { get; set; }

        public int ProjectId { get; set; }
        public virtual required Project Project { get; set; }
    }
}