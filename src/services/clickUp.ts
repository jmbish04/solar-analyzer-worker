export class ClickUpService {
  token: string;
  constructor(token: string) {
    this.token = token;
  }
  async updateTaskStatus(taskId: string, status: string): Promise<void> {
    const resp = await fetch(`https://api.clickup.com/api/v2/task/${taskId}`, {
      method: 'PUT',
      headers: {
        'Authorization': this.token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status })
    });
    if (!resp.ok) {
      console.warn('ClickUp update failed', await resp.text());
    }
  }
}
