using System.ComponentModel.DataAnnotations;

namespace VuSolutionsWeb.Models
{
    public class Project
    {
        [Key]
        public int Id { get; set; }

        public required string Name { get; set; }
        public decimal? BudgetHours { get; set; }
        public decimal? BudgetCost { get; set; }
        public string? Url { get; set; }
        public string? Ref { get; set; }
        public bool Closed { get; set; }
        
        public virtual ICollection<ApplicationUserProject>? AppUserProjects { get; set; }

        public int? OrganizationId { get; set; }
        public virtual Organization? Organization { get; set; }
        public virtual ICollection<ProjectComment>? ProjectComments { get; set; }

        public virtual required ICollection<TimeEntry> TimeEntries { get; set; }
    }

    public class ProjectComment
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public string? Comment { get; set; }
        public string? Url { get; set; }
    
        public virtual required Project Project { get; set; }
    }
}