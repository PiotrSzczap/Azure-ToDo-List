import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideHttpClient } from '@angular/common/http';

interface RuntimeConfig { apiBaseUrl: string; }
async function loadConfig(): Promise<RuntimeConfig> {
	try {
		const r = await fetch('/config.json', { cache: 'no-store' });
		if (r.ok) return r.json();
	} catch {}
	return { apiBaseUrl: '' };
}

const configPromise = loadConfig();

bootstrapApplication(AppComponent, {
	providers: [
		provideHttpClient(),
		{ provide: 'RUNTIME_CONFIG', useFactory: () => configPromise, deps: [] }
	]
}).catch(err => console.error(err));
