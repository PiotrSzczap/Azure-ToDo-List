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

// Load config first, then bootstrap to ensure components see resolved base URL immediately
loadConfig().then(cfg => {
	const configPromise = Promise.resolve(cfg);
	return bootstrapApplication(AppComponent, {
		providers: [
			provideHttpClient(),
			{ provide: 'RUNTIME_CONFIG', useFactory: () => configPromise, deps: [] }
		]
	});
}).catch(err => console.error('Bootstrap error', err));
