const pool = require('../../config/db');

async function autoLinkFactoryToInstallationTasks(tenantId, projectId) {
  if (!projectId) return;
  try {
    // 1. Find all factory/production/manufacturing tasks
    const { rows: factoryTasks } = await pool.query(
      `SELECT id, title FROM tasks 
       WHERE project_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         AND (title ILIKE '%factory%' OR title ILIKE '%production%' OR title ILIKE '%manufacturing%')`,
      [projectId, tenantId]
    );

    // 2. Find all installation/assembly tasks
    const { rows: installationTasks } = await pool.query(
      `SELECT id, title FROM tasks 
       WHERE project_id = $1 AND tenant_id = $2 AND deleted_at IS NULL
         AND (title ILIKE '%installation%' OR title ILIKE '%assembly%')`,
      [projectId, tenantId]
    );

    if (factoryTasks.length === 0 || installationTasks.length === 0) {
      return;
    }

    const taskDependencyRepository = require('../../repositories/taskDependencyRepository');

    // 3. For each installation task, create a finish-to-start dependency on each factory task
    for (const instTask of installationTasks) {
      for (const factTask of factoryTasks) {
        // Verify no self-loop
        if (instTask.id === factTask.id) continue;

        // Double check if dependency already exists
        const { rows: depCheck } = await pool.query(
          `SELECT id FROM task_dependencies 
           WHERE project_id = $1 AND tenant_id = $2 AND task_id = $3 AND depends_on_task_id = $4`,
          [projectId, tenantId, instTask.id, factTask.id]
        );

        if (depCheck.length === 0) {
          // Verify no cycle
          const hasCycle = await taskDependencyRepository.hasCircularDependency(
            tenantId,
            projectId,
            instTask.id,
            factTask.id
          );

          if (!hasCycle) {
            await taskDependencyRepository.createDependency(tenantId, projectId, {
              taskId: instTask.id,
              dependsOnTaskId: factTask.id,
              dependencyType: 'finish-to-start'
            });
            console.log(`[Dependency Linkage] Auto-linked task "${instTask.title}" (${instTask.id}) to depend on "${factTask.title}" (${factTask.id})`);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Dependency Linkage] Error auto-linking factory to installation tasks:', error);
  }
}

module.exports = { autoLinkFactoryToInstallationTasks };
