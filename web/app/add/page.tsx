import { AddJobForm } from './add-job-form';

export default function AddJobPage() {
  return (
    <main>
      <header className="page-head">
        <div>
          <h1>Add a job</h1>
          <p className="subtitle">For a posting you found yourself. It is added to your list and scored when you ask for a cover letter.</p>
        </div>
      </header>
      <AddJobForm />
    </main>
  );
}
