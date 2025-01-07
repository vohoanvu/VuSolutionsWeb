using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using VuSolutionsWeb.Models;

namespace VuSolutionsWeb.Data
{
    public class ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : IdentityDbContext<ApplicationUser>(options)
    {
        public DbSet<Project> Projects { get; set; } = null!;
        public DbSet<ProjectComment> ProjectComments { get; set; } = null!;
        public DbSet<TimeEntry> TimeEntries { get; set; } = null!;
        public DbSet<Organization> Organizations { get; set; } = null!;
        public DbSet<ApplicationUserProject> ApplicationUserProjects { get; set; } = null!;
        public DbSet<ContentEntity> ContentEntities { get; set; } = null!;

        protected override void OnModelCreating(ModelBuilder builder)
        {
            base.OnModelCreating(builder); // Important: Keep this for Identity tables

            // Customize Identity table names (optional)
            builder.Entity<ApplicationUser>().ToTable("Users");
            builder.Entity<IdentityRole>().ToTable("Roles");
            builder.Entity<IdentityUserRole<string>>().ToTable("UserRoles");
            builder.Entity<IdentityUserClaim<string>>().ToTable("UserClaims");
            builder.Entity<IdentityUserLogin<string>>().ToTable("UserLogins");
            builder.Entity<IdentityRoleClaim<string>>().ToTable("RoleClaims");
            builder.Entity<IdentityUserToken<string>>().ToTable("UserTokens");

            // Configure ApplicationUser relationships
            builder.Entity<ApplicationUser>()
                .HasOne(u => u.Organization)
                .WithMany()
                .HasForeignKey(u => u.OrganizationId)
                .IsRequired(false);

            // Configure ApplicationUserProject (composite key)
            builder.Entity<ApplicationUserProject>()
                .HasKey(aup => new { aup.UserId, aup.ProjectId });

            // Configure Project relationships
            builder.Entity<Project>(entity =>
            {
                entity.HasOne(p => p.Organization)
                    .WithMany(o => o.Projects)
                    .HasForeignKey(p => p.OrganizationId);

                entity.HasMany(p => p.TimeEntries)
                    .WithOne(te => te.Project)
                    .HasForeignKey(te => te.ProjectId);

                entity.HasMany(p => p.ProjectComments)
                    .WithOne(pc => pc.Project)
                    .HasForeignKey(pc => pc.ProjectId);
            });

            // Configure ApplicationUserProject relationships
            builder.Entity<ApplicationUserProject>(entity =>
            {
                entity.HasOne(aup => aup.User)
                    .WithMany()
                    .HasForeignKey(aup => aup.UserId);

                entity.HasOne(aup => aup.Project)
                    .WithMany(p => p.AppUserProjects)
                    .HasForeignKey(aup => aup.ProjectId);
            });

            // Configure TimeEntry
            builder.Entity<TimeEntry>()
                .Property(te => te.Hours)
                .HasPrecision(18, 2);

            // Configure ContentEntity
            builder.Entity<ContentEntity>(entity =>
            {
                entity.Property(ce => ce.ContentType)
                    .HasConversion<string>();
                
                entity.Property(ce => ce.Content)
                    .HasMaxLength(4000);
            });
        }
    }
}