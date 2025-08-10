import { Component, signal, effect, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { HttpClient, HttpClientModule } from '@angular/common/http';

interface TodoItem {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule, DragDropModule, HttpClientModule],
  template: `
  <div class="min-h-screen bg-gray-100 text-gray-900 p-6">
    <div class="max-w-xl mx-auto bg-white shadow rounded p-6">
      <h1 class="text-2xl font-bold mb-4">Todo List</h1>
      <form (ngSubmit)="addTodo()" class="flex gap-2 mb-4">
        <input [(ngModel)]="newTitle" name="title" required placeholder="New task" class="flex-1 border rounded px-3 py-2" />
        <button class="bg-blue-600 text-white px-4 py-2 rounded" type="submit">Add</button>
      </form>
      <div cdkDropList (cdkDropListDropped)="drop($event)" class="space-y-2">
        <div *ngFor="let t of todos()" cdkDrag class="bg-gray-50 border rounded p-3 flex items-center gap-3">
          <input type="checkbox" [(ngModel)]="t.completed" name="completed-{{t.id}}" (change)="save(t)" />
          <input [(ngModel)]="t.title" name="title-{{t.id}}" (blur)="save(t)" class="flex-1 bg-transparent outline-none" />
          <button (click)="remove(t)" class="text-red-600">×</button>
        </div>
      </div>
    </div>
  </div>
  `,
  styles: [`:host { display:block; }`]
})
export class AppComponent {
  newTitle = '';
  private _todos = signal<TodoItem[]>([]);
  todos = this._todos;
  private api = '/api/todos';

  constructor(private http: HttpClient, @Inject('RUNTIME_CONFIG') private cfgPromise: Promise<any>){
    // Adjust base API dynamically if provided
    this.cfgPromise.then(cfg => {
      if (cfg?.apiBaseUrl) {
        const base = cfg.apiBaseUrl.replace(/\/$/, '');
        this.api = base + '/api/todos';
      }
      this.refresh();
    });
  }

  refresh(){
    this.http.get<TodoItem[]>(this.api).subscribe(items => this._todos.set(items));
  }

  addTodo() {
    if (!this.newTitle.trim()) return;
    const title = this.newTitle.trim();
    this.newTitle='';
    this.http.post<TodoItem>(this.api, { title }).subscribe(created =>{
      this._todos.update(list => [...list, created].sort((a,b)=>a.order-b.order));
    });
  }
  save(item: TodoItem){
    this.http.put<TodoItem>(`${this.api}/${item.id}`, { title: item.title, completed: item.completed, order: item.order }).subscribe(updated =>{
      this._todos.update(list => list.map(t => t.id===updated.id? updated: t));
    });
  }
  remove(item: TodoItem){
    this.http.delete(`${this.api}/${item.id}`).subscribe(()=>{
      this._todos.update(list => list.filter(t=>t.id!==item.id));
    });
  }
  drop(event: CdkDragDrop<TodoItem[]>) {
    const arr = [...this._todos()];
    moveItemInArray(arr, event.previousIndex, event.currentIndex);
    // Recompute order sequentially
    arr.forEach((t, idx) => t.order = idx + 1);
    this._todos.set(arr);
    this.http.post(`${this.api}/reorder`, { items: arr.map(t => ({ id: t.id, order: t.order })) }).subscribe();
  }
}
