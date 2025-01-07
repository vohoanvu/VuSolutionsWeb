using System.ComponentModel.DataAnnotations;

namespace VuSolutionsWeb.Models
{
    public class ContentEntity
    {
        [Key]
        public int Id { get; set; }

        public string? Title { get; set; }

        public ContentType ContentType { get; set; }

        [MaxLength(4000)]
        public string? Content { get; set; }

        public string? CreatedBy { get; set; }

        public DateTime CreatedOn { get; set; }

        public string? LastModifiedBy { get; set; }

        public DateTime LastModifiedOn { get; set; }

        public bool IsPublished { get; set; }
    }

    public enum ContentType
    {
        None = 0,
        Video,
        Resume,
        Article,
        Page
    }
}