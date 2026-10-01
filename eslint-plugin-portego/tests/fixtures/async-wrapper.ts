import { AsyncService } from './App/Core/services/async.service';

declare const asyncService: AsyncService;
declare function run(): Promise<void>;
declare function synchronous(): void;

asyncService.await(async () => {
    run();
    await run();
    if (true) void run();
    synchronous();
    return run();
});

asyncService.await(() => run());

asyncService.await(async () => {
    const handled = run();
    await handled;
    const ignored = run();
    return run();
});

asyncService.await(async () => {
    const returned = run();
    return returned;
});

const unrelated = { await: (fn: () => Promise<unknown>) => { void fn(); } };
unrelated.await(async () => { run(); });

asyncService.await(async () => {
    let pending: Promise<void>;
    pending = run();
    await pending;
});
