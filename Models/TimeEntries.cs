using System.ComponentModel.DataAnnotations.Schema;

namespace VuSolutionsWeb.Models
{
    public class TimeEntry
    {
        public long Id { get; set; }

        public required string UserId { get; set; }

        public required string Description { get; set; }

        public decimal Hours { get; set; }

        public DateTime WorkingDate { get; set; }

        public string? Reference { get; set; }

        public bool Closed { get; set; }

        public bool Paid { get; set; }
    
        [ForeignKey("Project")]
        public int ProjectId { get; set; }
        public virtual required Project Project { get; set; }
    }
}