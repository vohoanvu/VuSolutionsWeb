using System.ComponentModel.DataAnnotations;

namespace VuSolutionsWeb.Models
{
    public class Organization
    {
        [Key]
        public int Id { get; set; }
        
        public required string Name { get; set; }
        public string? Url { get; set; }
        public string? Address { get; set; }
        public string? City { get; set; }
        public string? State { get; set; }
        public string? PostalCode { get; set; }

        public bool Closed { get; set; }
        
        public virtual ICollection<Project>? Projects { get; set; }
    }
}