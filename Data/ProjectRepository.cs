using Microsoft.EntityFrameworkCore;
using VuSolutionsWeb.Models;

namespace VuSolutionsWeb.Data
{
    public interface IProjectRepository : IRepository<Project>
    {
        Task<IEnumerable<Project>> GetProjectsByOrganizationAsync(int organizationId);
        Task<IEnumerable<Project>> GetActiveProjectsAsync();
        Task<IEnumerable<Project>> GetProjectsWithUsersAsync();
    }

    public class ProjectRepository : Repository<Project>, IProjectRepository
    {

        public ProjectRepository(ApplicationDbContext context) : base(context)
        {
        }

        public async Task<IEnumerable<Project>> GetProjectsByOrganizationAsync(int organizationId)
        {
            return await _context.Projects
                .Where(p => p.OrganizationId == organizationId)
                .Include(p => p.TimeEntries)
                .Include(p => p.ProjectComments)
                .ToListAsync();
        }

        public async Task<IEnumerable<Project>> GetActiveProjectsAsync()
        {
            return await _context.Projects
                .Where(p => !p.Closed)
                .ToListAsync();
        }

        public async Task<IEnumerable<Project>> GetProjectsWithUsersAsync()
        {
            return await _context.Projects
                .Include(p => p.AppUserProjects!)
                    .ThenInclude(aup => aup.User)
                .Include(p => p.Organization)
                .ToListAsync();
        }
    }
}