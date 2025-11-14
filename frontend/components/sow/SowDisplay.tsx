import React from 'react';

interface SowDisplayProps {
  sowData: any;
}

const SowDisplay: React.FC<SowDisplayProps> = ({ sowData }) => {
  if (!sowData) {
    return null;
  }

  return (
    <div className="p-4 bg-gray-100 rounded-lg">
      <h2 className="text-2xl font-bold mb-4">Generated SOW</h2>
      
      <div className="mb-4">
        <h3 className="text-xl font-semibold">Project Overview</h3>
        <p>{sowData.projectOverview}</p>
      </div>

      <div className="mb-4">
        <h3 className="text-xl font-semibold">Project Objectives</h3>
        <ul>
          {sowData.projectObjectives.map((objective: string, index: number) => (
            <li key={index} className="list-disc ml-6">{objective}</li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="text-xl font-semibold">Scopes</h3>
        {sowData.scopes.map((scope: any, index: number) => (
          <div key={index} className="mb-4 p-2 border rounded">
            <h4 className="text-lg font-semibold">{scope.scope_name}</h4>
            <p>{scope.prose}</p>
            <pre className="bg-gray-800 text-white p-2 rounded mt-2">
              <code>{JSON.stringify(scope.jsonData, null, 2)}</code>
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SowDisplay;
